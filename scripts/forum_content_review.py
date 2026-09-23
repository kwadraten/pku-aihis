"""Apply a versioned, text-hash-bound classroom allowlist without publishing forum text."""
import json
from pathlib import Path

DEFAULT_REVIEW = Path(__file__).resolve().parents[1] / "data/week03/cross-domain/audit/forum-content-review.json"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def decisions(review):
    assert review["schema_version"] == 1
    assert review["public_redistribution_allowed"] is False
    assert review["upstream_commit"] == "0c801f85a4506dcfdb9afced4ceaa5ab2757987d"
    result = {}

    def add(key, decision, text_hash=None):
        assert key not in result, (key, "duplicate content decision")
        result[key] = {"decision": decision, "text_sha256": text_hash}

    for r in review["approved_titles"] + review["approved_replies"]:
        add(r["id"], "allow_local_only", r["text_sha256"])
    for n in review["rule_excluded_rows"]:
        add(f"LEY-GOOD-{n:05d}", "exclude_topic_rule")
    for n in review["semantic_review_not_selected_rows"]:
        add(f"LEY-GOOD-{n:05d}", "not_selected_after_semantic_review")
    for key in review["reply_not_selected_ids"]:
        add(key, "not_selected_after_semantic_review")
    counts = review["counts"]
    assert counts["input_titles"] == 2487 and counts["input_replies"] == 13
    assert len(review["approved_titles"]) == counts["approved_titles"]
    assert len(review["approved_replies"]) == counts["approved_replies"]
    assert len(review["rule_excluded_rows"]) == counts["excluded_by_rule"]
    assert len(review["semantic_review_not_selected_rows"]) == counts["not_selected_after_semantic_review"]
    assert len(review["reply_not_selected_ids"]) == counts["excluded_replies"]
    assert len(result) == counts["input_titles"] + counts["input_replies"] == 2500
    # Explicit user-flagged regression: never permit this record into teaching material.
    assert result["LEY-GOOD-00041"]["decision"] != "allow_local_only"
    assert all(result[f"LEY-GOOD-{n:05d}"]["decision"] != "allow_local_only"
               for n in review["user_flagged_regression_rows"])
    return result


def apply_review(root, review_path=DEFAULT_REVIEW):
    review = read_json(review_path)
    policy = decisions(review)
    rows_path = root / "audit/input-records.jsonl"
    rows = [json.loads(line) for line in rows_path.read_text(encoding="utf-8").split("\n") if line.strip()]
    seen = set()
    for r in rows:
        if r["source_id"] not in {"LEYMORE-GOOD", "LEYMORE-REPLIES"}:
            continue
        assert r["decision"] == "exclude", "Content approval does not grant redistribution rights"
        content = policy[r["id"]]
        if content["text_sha256"]:
            assert content["text_sha256"] == r["text_sha256"], (r["id"], "review is stale")
        r["classroom_content_decision"] = content["decision"]
        r["content_review_date"] = review["review_date"]
        r["original_url_withheld_from_public_audit"] = True
        r.pop("thread_url", None)
        r.pop("post_url", None)
        seen.add(r["id"])
    assert seen == policy.keys()
    rows_path.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")
    sources = read_json(root / "sources.json")
    for s in sources:
        if s["source_id"] not in {"LEYMORE-GOOD", "LEYMORE-REPLIES"}:
            continue
        s["content_review_file"] = "audit/forum-content-review.json"
        s["content_review_does_not_grant_redistribution"] = True
        if s["source_id"] == "LEYMORE-REPLIES":
            s["source_url"] = None
            s["original_url_withheld_from_public_audit"] = True
    write_json(root / "sources.json", sources)
    retrieval = read_json(root / "audit/retrieval.json")
    for r in retrieval:
        if any("tieba.baidu.com" in (r.get(key) or "") for key in ["requested_url", "final_url"]):
            r["requested_url"] = r["final_url"] = None
            r["original_url_withheld_from_public_audit"] = True
    write_json(root / "audit/retrieval.json", retrieval)
    summary = read_json(root / "audit/summary.json")
    summary["forum_content_review"] = review["counts"]
    summary["forum_public_text_records"] = 0
    summary["forum_original_links_in_record_audit"] = 0
    write_json(root / "audit/summary.json", summary)
    write_json(root / "audit/forum-content-review.json", review)


def validate_review(root):
    review = read_json(root / "audit/forum-content-review.json")
    policy = decisions(review)
    rows = [json.loads(line) for line in (root / "audit/input-records.jsonl").read_text(encoding="utf-8").split("\n") if line.strip()]
    seen = set()
    for r in rows:
        if r["source_id"] not in {"LEYMORE-GOOD", "LEYMORE-REPLIES"}:
            continue
        expected = policy[r["id"]]
        assert r["id"] not in seen
        assert r["decision"] == "exclude"
        assert r["classroom_content_decision"] == expected["decision"]
        assert not any(k in r for k in ["text", "title", "thread_url", "post_url"])
        assert r["original_url_withheld_from_public_audit"] is True
        if expected["text_sha256"]:
            assert expected["text_sha256"] == r["text_sha256"]
        seen.add(r["id"])
    assert seen == policy.keys()
    summary = read_json(root / "audit/summary.json")
    assert summary["forum_content_review"] == review["counts"]
    assert summary["forum_public_text_records"] == summary["forum_original_links_in_record_audit"] == 0
    assert all(not s["source_id"].startswith("LEY") or s["decision"] == "exclude"
               for s in read_json(root / "sources.json"))
    for name in ["sources.json", "audit/retrieval.json", "audit/input-records.jsonl"]:
        assert "tieba.baidu.com" not in (root / name).read_text(encoding="utf-8"), (name, "unreviewed thread link")
    return review["counts"]


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=DEFAULT_REVIEW.parents[1])
    parser.add_argument("--review", type=Path, default=DEFAULT_REVIEW)
    args = parser.parse_args()
    apply_review(args.root, args.review)
    print(json.dumps(validate_review(args.root), ensure_ascii=False, indent=2))
