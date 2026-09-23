"""Regression checks for the classroom review boundary; no rejected text fixtures."""
import copy
from pathlib import Path
import shutil
import tempfile
import unittest

from forum_content_review import DEFAULT_REVIEW, decisions, read_json, validate_review, write_json


class ForumContentBoundary(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        source = DEFAULT_REVIEW.parents[1]
        shutil.copytree(source / "audit", self.root / "audit")
        shutil.copyfile(source / "sources.json", self.root / "sources.json")

    def test_current_review(self):
        self.assertEqual(validate_review(self.root)["approved_titles"], 239)

    def test_user_flagged_row_cannot_replace_an_approved_row(self):
        review = copy.deepcopy(read_json(DEFAULT_REVIEW))
        displaced = review["approved_titles"][0]
        review["rule_excluded_rows"].remove(41)
        review["semantic_review_not_selected_rows"].append(displaced["row"])
        review["counts"]["excluded_by_rule"] -= 1
        review["counts"]["not_selected_after_semantic_review"] += 1
        review["approved_titles"][0] = {"id": "LEY-GOOD-00041", "row": 41,
                                         "text_sha256": "0" * 64}
        with self.assertRaises(AssertionError):
            decisions(review)

    def test_changed_approved_text_hash_is_rejected(self):
        review = read_json(self.root / "audit/forum-content-review.json")
        review["approved_titles"][0]["text_sha256"] = "0" * 64
        write_json(self.root / "audit/forum-content-review.json", review)
        with self.assertRaises(AssertionError):
            validate_review(self.root)

    def test_content_approval_cannot_enable_public_redistribution(self):
        sources = read_json(self.root / "sources.json")
        next(s for s in sources if s["source_id"] == "LEYMORE-GOOD")["decision"] = "include"
        write_json(self.root / "sources.json", sources)
        with self.assertRaises(AssertionError):
            validate_review(self.root)

    def test_unreviewed_thread_link_cannot_reenter_retrieval_audit(self):
        receipts = read_json(self.root / "audit/retrieval.json")
        receipts.append({"requested_url": "https://tieba.baidu.com/p/test-regression"})
        write_json(self.root / "audit/retrieval.json", receipts)
        with self.assertRaises(AssertionError):
            validate_review(self.root)


if __name__ == "__main__":
    unittest.main()
