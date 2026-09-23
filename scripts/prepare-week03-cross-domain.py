#!/usr/bin/env python3
"""Audit the supplied September corpus against saved official downloads.

Requires PyMuPDF for source preparation only. No network or implicit downloads.
The evidence directory contains input-sources.json, fetch-results.json and evidence/.
Rejected texts and downloaded HTML never enter the public output.
"""
import argparse
from collections import Counter, defaultdict
from html import unescape
from html.parser import HTMLParser
import hashlib
import json
from pathlib import Path
import re
import shutil
import unicodedata

import fitz
from forum_content_review import apply_review, DEFAULT_REVIEW


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_lines(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(json.dumps(x, ensure_ascii=False) + "\n" for x in rows), encoding="utf-8")


class Metadata(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.values = defaultdict(list)
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "meta" and "name" in attrs and "content" in attrs:
            self.values[attrs["name"]].append(attrs["content"])


def title_key(text):
    return "".join(c for c in unicodedata.normalize("NFKD", text).lower() if c.isalnum())


def pdf_text(path):
    with fitz.open(path) as doc:
        pages = [f"\n\n[PDF page {i}]\n\n" + p.get_text(sort=False).replace("\x00", "")
                 .replace("\r\n", "\n").replace("\r", "\n").strip() + "\n"
                 for i, p in enumerate(doc, 1)]
    return "".join(pages), pages


def page_chunks(sid, pages):
    offset = 0
    for number, page in enumerate(pages, 1):
        start = 0
        while start < len(page):
            end = min(start + 1400, len(page))
            if end < len(page):
                split = page.rfind("\n", start + 700, end)
                if split >= 0:
                    end = split + 1
            yield dict(id=f"{sid}-p{number:03d}-{start:05d}", source_id=sid,
                       start_char=offset + start, end_char=offset + end,
                       locator=f"PDF page {number}", role="paper", text=page[start:end])
            start = end
        offset += len(page)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--evidence", required=True, type=Path)
    parser.add_argument("--reply-snapshot", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--content-review", type=Path, default=DEFAULT_REVIEW)
    args = parser.parse_args()
    inp, ev, out = args.input, args.evidence, args.output
    if out.exists() and any(out.iterdir()):
        raise SystemExit("Output must be empty; preserve existing releases.")
    source_list = read_json(ev / "input-sources.json")
    sources = {s["source_id"]: dict(s) for s in source_list}
    assert len(sources) == len(source_list) == 21
    fetches = {r["key"]: r for r in read_json(ev / "fetch-results.json")}
    for r in fetches.values():
        if r["curl_exit"] == 0:
            assert digest((ev / "evidence" / r["evidence_file"]).read_bytes()) == r["sha256"]
    # These licenses were reviewed on the exact version, not inferred from access.
    accepted = {"1906.11238v1": "CC-BY-3.0", "1710.05832v1": "CC-BY-4.0",
                "P01": "CC-BY-3.0", "1606.07772v1": "CC-BY-NC-SA-4.0",
                "plos_0323185": "CC-BY-4.0", **{s: "PG-US-PUBLIC-DOMAIN" for s in sources if s.startswith("B")}}
    books_raw = {}
    audit_sources = []
    for sid, original in sources.items():
        s = dict(original)
        page_record = fetches[sid + "-page"]
        assert page_record["status"] == "200" and page_record["curl_exit"] == 0
        page = (ev / "evidence" / page_record["evidence_file"]).read_text()
        meta = Metadata(page).values
        s.update(source_page_sha256=page_record["sha256"], checked_at=page_record["checked_at"],
                 source_page_http=200, input_text_sha256=digest((inp / s["text_file"]).read_bytes()))
        s["source_page_license_urls"] = sorted(set(re.findall(
            r'https?://(?:creativecommons.org|arxiv.org/licenses)[^\s"<>]+', page)))
        if "citation_title" in meta:
            assert title_key(meta["citation_title"][0]) == title_key(s["title"]), sid
            s["official_title"] = meta["citation_title"][0]
            s["official_authors"] = meta.get("citation_author", [])
            s["doi"] = meta.get("citation_doi", [None])[0]
        if sid == "B01-INTRO":
            s["raw_file"] = sources["B01"]["raw_file"]
        raw = inp / s["raw_file"]
        fetched = fetches[("B01" if sid == "B01-INTRO" else sid) + "-original"]
        assert fetched["curl_exit"] == 0 and fetched["status"] == "200"
        assert raw.read_bytes() == (ev / "evidence" / fetched["evidence_file"]).read_bytes(), sid
        s.update(raw_sha256=digest(raw.read_bytes()), raw_bytes=raw.stat().st_size,
                 download_url=fetched["requested_url"], original_http=200,
                 raw_matches_official_download=True, download_checked_at=fetched["checked_at"])
        if raw.suffix == ".pdf":
            extracted, pages = pdf_text(raw)
            assert extracted == (inp / s["text_file"]).read_text(), sid
            s.update(pdf_pages=len(pages), extraction_matches_pdf=True,
                     extraction="PyMuPDF get_text(sort=False), page labels, no manual text correction",
                     pymupdf_version=fitz.VersionBind)
        else:
            t = raw.read_text(encoding="utf-8-sig")
            derived = (inp / s["text_file"]).read_text()
            assert derived in t, sid
            assert "Public domain in the USA" in page, sid
            books_raw[sid] = t
            s.update(raw_text_start_char=t.index(derived), raw_text_end_char=t.index(derived)+len(derived),
                     raw_text_encoding="UTF-8-sig with universal newline normalization",
                     raw_text_matches=True, edition_header=t[:t.index("*** START")].strip(),
                     extraction="Gutenberg body boundaries; Republic introduction separated from Books I–X")
        if sid in accepted:
            s.update(decision="include", license=accepted[sid], reason="verified_source_and_redistribution_basis")
        elif sid == "2106.07742v1":
            s.update(decision="superseded", reason="arxiv_CC_BY_4_page_but_ACM_restrictive_notice_in_v1_PDF",
                     replacement_source_id="acm_3497842")
        else:
            s.update(decision="exclude", reason="no_third_party_fulltext_redistribution_grant_verified")
        if sid == "1906.11238v1":
            s["license_basis"] = "PDF page 1 CC BY 3.0 notice; arXiv deposit license is recorded separately."
            s["journal_citation"] = "The Astrophysical Journal Letters 875:L1 (2019), 17 pp. DOI: 10.3847/2041-8213/ab0ec7"
        elif sid == "P01":
            s["license_basis"] = "PDF page 1 CC BY 3.0; arXiv page additionally displays CC BY 4.0. This package retains the PDF's 3.0 notice."
            s["journal_citation"] = "Physical Review Letters 116, 061102 (2016). DOI: 10.1103/PhysRevLett.116.061102"
        elif sid == "1710.05832v1":
            s["license_basis"] = "PDF page 1 and exact arXiv version page: CC BY 4.0."
            s["journal_citation"] = "Physical Review Letters 119, 161101 (2017). DOI: 10.1103/PhysRevLett.119.161101"
        elif sid == "plos_0323185":
            s["license_basis"] = "Publisher copyright notice and PDF page 1: CC BY 4.0."
            s["journal_citation"] = "PLOS ONE 20(6): e0323185 (2025). DOI: 10.1371/journal.pone.0323185"
        elif sid == "1606.07772v1":
            s["license_basis"] = "Exact arXiv v1 page: CC BY-NC-SA 4.0. Text extraction and chunks retain this license. Noncommercial use only."
        elif sid.startswith("B"):
            s["license_basis"] = "Gutenberg catalog: Public domain in the USA. Original file preserves the complete Project Gutenberg license and territory notice."
        audit_sources.append(s)
    by_id = {s["source_id"]: s for s in audit_sources}
    all_rows, by_source, row_audit = [], defaultdict(list), []
    seen = set()
    for path in sorted(inp.rglob("chunks.jsonl")):
        # JSONL separates on LF. str.splitlines() would split valid U+2028 text.
        for number, line in enumerate(path.read_text().split("\n"), 1):
            if not line.strip():
                continue
            r = json.loads(line)
            assert r["id"] not in seen
            seen.add(r["id"])
            full = (inp / r["text_file"]).read_text()
            assert full[r["start_char"]:r["end_char"]] == r["text"], r["id"]
            sid = r.get("source_id", "LEYMORE-GOOD")
            by_source[sid].append(r)
            row_audit.append(dict(id=r["id"], source_id=sid,
                input_jsonl=str(path.relative_to(inp)), input_line=number,
                text_sha256=digest(r["text"].encode()), text_offsets_match=True,
                decision=by_id[sid]["decision"] if sid in by_id else "exclude"))
    # Every record in the selected forum file must match the fixed upstream blob.
    forum = inp / "02_弱智吧_Leymore推荐帖"
    upstream_bytes = (ev / "evidence/leymore-good.json").read_bytes()
    upstream = json.loads(upstream_bytes)
    tree = read_json(ev / "evidence/leymore-tree.json")
    blob = next(x["sha"] for x in tree["tree"] if x["path"] == "data/ruozhiba-title-good.json")
    assert hashlib.sha1(f"blob {len(upstream_bytes)}\0".encode()+upstream_bytes).hexdigest() == blob
    assert not any("license" in x["path"].lower() for x in tree["tree"])
    selected = read_json(forum / "推荐帖原字段节选.json")
    assert len(selected) == len(by_source["LEYMORE-GOOD"]) == 2487
    for selected_row, r in zip(selected, by_source["LEYMORE-GOOD"]):
        n = selected_row["source_row_1based"]
        original = upstream[n-1]
        assert selected_row["original_record"] == original
        assert r["source_row_1based"] == n and r["thread_url"] == "https://tieba.baidu.com"+original["href"]
        t = original["title"] + ("\n"+original["abs"] if original["abs"] and original["abs"] != original["title"] else "")
        t = t.replace("\r\n", "\n").replace("\r", "\n")
        assert r["text"] == f'[{r["id"]}]\n{t}\n\n'
    forum_by_id = {r["id"]: r for r in by_source["LEYMORE-GOOD"]}
    for a in row_audit:
        if a["source_id"] == "LEYMORE-GOOD":
            r = forum_by_id[a["id"]]
            a.update(upstream_row_1based=r["source_row_1based"], upstream_record_matches=True,
                     thread_url=r["thread_url"], original_post_check="not_fully_checked",
                     reason="no_repository_license_or_post_author_redistribution_permission")
    snapshot = args.reply_snapshot.read_text()
    parsed = {}
    for value in re.findall(r'''data-field=['"](.*?)['"]''', snapshot):
        try:
            d = json.loads(unescape(value))
        except (ValueError, TypeError):
            continue
        c = d.get("content")
        if isinstance(c, dict) and c.get("content"):
            parsed[str(c["post_id"])] = (c, d.get("author", {}))
    replies = read_json(forum / "已核验原帖回复.json")["replies"]
    for r in replies:
        c, author = parsed[r["post_id"]]
        assert r["text"] == unescape(re.sub("<[^>]+>", "", c["content"])).strip()
        assert str(c["thread_id"]) == r["thread_id"] and c["post_no"] == r["floor"]
        assert (author.get("user_name") or author.get("user_nickname")) == r["author"]
        row_audit.append(dict(id="LEY-REPLY-"+r["post_id"],source_id="LEYMORE-REPLIES",
            text_sha256=digest(r["text"].encode()), snapshot_content_and_identity_match=True,
            snapshot_sha256=digest(args.reply_snapshot.read_bytes()), post_url=r["post_url"],
            original_post_check="saved_snapshot_verified_current_request_403",
            decision="exclude",reason="post_author_redistribution_permission_not_verified"))
    assert len(row_audit) == 5876
    for sid in ["LEYMORE-GOOD", "LEYMORE-REPLIES"]:
        audit_sources.append(dict(source_id=sid,decision="exclude",license="not_verified",
            source_url=(f'https://github.com/Leymore/ruozhiba/blob/{tree["sha"]}/data/ruozhiba-title-good.json'
                        if sid.endswith("GOOD") else "https://tieba.baidu.com/p/4728759743?fr=good"),
            upstream_commit=tree["sha"], upstream_blob_sha1=blob,
            reason="no_repository_license_or_post_author_redistribution_permission",
            record_count=2487 if sid.endswith("GOOD") else 13))
    # Use the licensed published article; do not silently relabel the preprint.
    published = ev / "evidence/2106.07742-published.pdf"
    text, pages = pdf_text(published)
    assert len(pages) == 18 and "Creative Commons Attribution International 4.0" in pages[0]
    assert "10.1145/3497842" in pages[0]
    replacement = dict(source_id="acm_3497842", title="Can BERT Dig It? Named Entity Recognition for Information Retrieval in the Archaeology Domain",
        authors=["Alex Brandsen", "Suzan Verberne", "Karsten Lambers", "Milco Wansleeben"], group="人文社科",
        source_url="https://doi.org/10.1145/3497842", download_url="https://d-nb.info/137308653X/34",
        version="J. Comput. Cult. Herit. 15(3), Article 51, September 2022; published version",
        journal_citation="ACM Journal on Computing and Cultural Heritage 15(3), Article 51 (2022), 18 pp. DOI: 10.1145/3497842",
        raw_file="originals/acm_3497842.pdf",text_file="texts/acm_3497842.txt",pdf_pages=18,
        raw_sha256=digest(published.read_bytes()), raw_bytes=published.stat().st_size,
        decision="include", license="CC-BY-4.0", license_basis="Published PDF page 1, visually checked; National Library archive copy.",
        replaces_input_source_id="2106.07742v1", extraction="PyMuPDF get_text(sort=False), page labels, no manual text correction",
        pymupdf_version=fitz.VersionBind)
    published_receipt = read_json(ev / "published-receipt.json")
    assert published_receipt["sha256"] == replacement["raw_sha256"]
    assert published_receipt["status"] == "200" and published_receipt["curl_exit"] == 0
    replacement.update(checked_at=published_receipt["checked_at"], original_http=200,
                       original_download_sha256=published_receipt["sha256"])
    audit_sources.append(replacement)
    accepted[replacement["source_id"]] = replacement["license"]
    by_source[replacement["source_id"]] = list(page_chunks(replacement["source_id"], pages))
    out.mkdir(parents=True, exist_ok=True)
    for s in audit_sources:
        sid = s["source_id"]
        if s["decision"] != "include":
            continue
        is_book = sid.startswith("B")
        s["input_raw_file"] = s["raw_file"]
        s["input_text_file"] = s["text_file"]
        raw = published if sid == "acm_3497842" else inp / s["raw_file"]
        s["raw_file"] = "originals/" + ("B01.txt" if sid == "B01-INTRO" else sid + raw.suffix)
        s["text_file"] = f"texts/{sid}.txt"
        (out / "originals").mkdir(exist_ok=True)
        shutil.copyfile(raw, out / s["raw_file"])
        derived = text if sid == "acm_3497842" else (inp / s["input_text_file"]).read_text()
        (out / "texts").mkdir(exist_ok=True)
        (out / s["text_file"]).write_text(derived, encoding="utf-8")
        s["text_sha256"] = digest((out / s["text_file"]).read_bytes())
        s["chunk_file"] = f"imports/{sid}.jsonl"
        s["chunk_count"] = len(by_source[sid])
        if not is_book:
            s["license_file"] = "licenses/" + s["license"].lower() + ".txt"
            s["license_url"] = "https://creativecommons.org/licenses/" + s["license"].lower().removeprefix("cc-").replace("-4.0", "/4.0/").replace("-3.0", "/3.0/")
        else:
            s["license_file"] = s["raw_file"]
            s["license_url"] = "https://www.gutenberg.org/policy/license.html"
        rows = []
        for r in by_source[sid]:
            r = dict(r)
            r.update(source_id=sid, title=s["title"], author="; ".join(s.get("authors", [s.get("author", "")])),
                     source_url=s["source_url"], raw_file=s["raw_file"], text_file=s["text_file"],
                     license=s["license"], license_url=s["license_url"],
                     status="出处与切块已核；PDF自动提取，未逐字校订" if not is_book else "电子原文一致；章节与字符定位")
            if not is_book:
                r["pdf_page"] = int(re.search(r"PDF page (\d+)", r["locator"])[1])
            else:
                r.update(raw_start_char=s["raw_text_start_char"]+r["start_char"],
                         raw_end_char=s["raw_text_start_char"]+r["end_char"])
                # Gutenberg's edition-selection preface is editorial, not Darwin's prose.
                if sid == "B02" and r["start_char"] < derived.index("On\nthe Origin of Species"):
                    r["role"] = "book_front_matter_with_gutenberg_editorial_notice"
            rows.append(r)
        write_lines(out / s["chunk_file"], rows)
        all_rows.extend(rows)
    for license_name in ["cc-by-3.0", "cc-by-4.0", "cc-by-nc-sa-4.0"]:
        (out / "licenses").mkdir(exist_ok=True)
        shutil.copyfile(ev / "evidence" / (license_name+".txt"), out / "licenses" / (license_name+".txt"))
    write_json(out / "sources.json", audit_sources)
    write_lines(out / "audit/input-records.jsonl", row_audit)
    # Fulltext-free network receipts: URLs, timestamps, HTTP status and hashes.
    write_json(out / "audit/retrieval.json", list(fetches.values()) + [published_receipt])
    summary = dict(input_sources=21, input_chunks=5863, input_replies=13,
        input_records_audited=len(row_audit), input_decisions=dict(Counter(r["decision"] for r in row_audit)),
        exact_official_original_matches=20, original_pdfs=16, original_books=4,
        selected_forum_records_matched=2487, saved_replies_matched=13,
        forum_upstream_count=len(upstream), forum_original_access="12 historical samples only; current successful-thread recheck returned 403",
        included_sources=sum(s["decision"]=="include" for s in audit_sources),
        included_papers=6, included_books=4, included_pdf_pages=111, included_records=len(all_rows),
        included_per_source={s["source_id"]:s["chunk_count"] for s in audit_sources if s["decision"]=="include"},
        source_review="AI source audit; not independent human review",
        limitations=["Not a factual correctness review of every claim in the literature",
                    "PDF equations, tables and reading order not manually proofread",
                    "Forum original URLs not exhaustively requested; provenance is to pinned upstream records",
                    "No embeddings, RAG evaluation or live website deployment"])
    write_json(out / "audit/summary.json", summary)
    apply_review(out, args.content_review)
    print(json.dumps(read_json(out / "audit/summary.json"), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
