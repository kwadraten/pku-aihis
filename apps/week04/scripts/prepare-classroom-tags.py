"""Apply the requested classroom labels to the exported subset, never the user's source library."""
import hashlib, json, sqlite3
from pathlib import Path

app = Path(__file__).resolve().parents[1]
seed = app / 'src/assets/seed'
profiles = json.loads((app / 'src/assets/data/classroom-tags.json').read_text(encoding='utf-8'))
database = seed / 'native-library.sqlite'
manifest_path = seed / 'native-seed.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest.setdefault('source_database_sha256', manifest['database']['sha256'])
with sqlite3.connect(database) as db:
    changed = False
    for item_id, tags in profiles.items():
        assert 0 < len(tags) <= 5 and len(tags) == len(set(tags))
        row = db.execute('select tags_json from items where item_id=?', (item_id,)).fetchone()
        if row and json.loads(row[0]) != tags:
            db.execute('update items set tags_json=? where item_id=?', (json.dumps(tags, ensure_ascii=False), item_id))
            changed = True
    if changed:
        db.execute('update library_metadata set library_revision=library_revision+1')
    manifest['library_revision'] = db.execute('select library_revision from library_metadata').fetchone()[0]
    assert db.execute('pragma integrity_check').fetchone()[0] == 'ok'
    assert not db.execute('pragma foreign_key_check').fetchall()
    for name in ['items', 'item_tag_memberships', 'library_metadata']:
        columns = [row[1] for row in db.execute('pragma table_info("' + name + '")')]
        rows = db.execute('select * from "' + name + '" order by ' + ','.join('"' + c + '"' for c in columns)).fetchall()
        manifest['rows'][name] = len(rows)
        manifest['row_sha256'][name] = hashlib.sha256(json.dumps(rows, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
    for item_id, tags in profiles.items():
        actual = [row[0] for row in db.execute('select tag from item_tag_memberships where item_id=? and is_active=1 order by ordinal', (item_id,))]
        assert actual == tags, (item_id, actual)
manifest['database']['sha256'] = hashlib.sha256(database.read_bytes()).hexdigest()
manifest['database']['bytes'] = database.stat().st_size
manifest['classroom_tags'] = profiles
manifest['mode'] = 'Original native SQLite schema, IDs, trees and files; classroom theme tags updated in the subset only'
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Classroom tags prepared: four documents, four or five tags each; native memberships and hashes verified')
