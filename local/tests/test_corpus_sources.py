import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from corpus_sources import read_original


class CorpusSourcesTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'originals').mkdir()
        self.body = b'checked original\r\n'
        (self.root / 'originals/book.txt').write_bytes(self.body)
        (self.root / 'sources.json').write_text(json.dumps([dict(decision='include', raw_file='originals/book.txt', raw_sha256=hashlib.sha256(self.body).hexdigest())]))

    def test_original_bytes_and_mime(self):
        self.assertEqual(read_original('originals/book.txt', self.root), (self.body, 'text/plain; charset=utf-8'))

    def test_unknown_private_or_traversal_path_rejected(self):
        for name in ['../sources.json', '/etc/passwd', 'sources.json', 'originals/../sources.json', 'originals/unreviewed.txt']:
            with self.assertRaises(FileNotFoundError):read_original(name, self.root)

    def test_changed_original_rejected(self):
        (self.root / 'originals/book.txt').write_bytes(b'changed')
        with self.assertRaises(ValueError):read_original('originals/book.txt', self.root)

    def test_excluded_original_rejected(self):
        p = self.root / 'sources.json'
        data = json.loads(p.read_text());data[0]['decision'] = 'exclude';p.write_text(json.dumps(data))
        with self.assertRaises(FileNotFoundError):read_original('originals/book.txt', self.root)


if __name__ == '__main__':unittest.main()
