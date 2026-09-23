"""Read only accepted, hash-verified corpus originals; never serve arbitrary local paths."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'data/week03/cross-domain'


def read_original(name, root=ROOT):
    relative = Path(name)
    if relative.is_absolute() or '..' in relative.parts or relative.parts[:1] != ('originals',):
        raise FileNotFoundError('Original not in corpus allowlist')
    sources = json.loads((root / 'sources.json').read_text())
    source = next((s for s in sources if s['decision'] == 'include' and s.get('raw_file') == name), None)
    if source is None:
        raise FileNotFoundError('Original not in corpus allowlist')
    target = root / relative
    if target.is_symlink() or not target.resolve().is_relative_to(root.resolve()):
        raise FileNotFoundError('Original not in corpus allowlist')
    body = target.read_bytes()
    if hashlib.sha256(body).hexdigest() != source['raw_sha256']:
        raise ValueError('原件散列与核验记录不符，请恢复已核验版本。')
    return body, 'application/pdf' if target.suffix == '.pdf' else 'text/plain; charset=utf-8'
