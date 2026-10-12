"""Apply reviewed, hash-pinned source edits in this feature branch only."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path.cwd().resolve()
def blob(text):
    data = text.encode('utf-8')
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()

updates = []
for recipe in sorted((ROOT / '.delivery/studio').glob('[0-9][0-9].json')):
    for item in json.loads(recipe.read_text(encoding='utf-8')):
        relative = Path(item['path'])
        assert not relative.is_absolute() and '..' not in relative.parts
        assert relative.parts[0] in {'corner', 'src', 'package.json', 'package-lock.json'}
        destination = ROOT / relative
        assert not any(part.is_symlink() for part in [destination, *destination.parents])
        original = destination.read_text(encoding='utf-8')
        assert blob(original) == item['before'], 'Changed baseline: ' + str(relative)
        modified = original
        previous_start = len(original) + 1
        for start, end, text in reversed(item['changes']):
            assert 0 <= start <= end < previous_start
            modified = modified[:start] + text + modified[end:]
            previous_start = start + 1
        assert blob(modified) == item['after'], 'Source integrity mismatch: ' + str(relative)
        updates.append((destination, modified))
assert len(updates) == 17
for destination, text in updates:
    destination.write_text(text, encoding='utf-8')
subprocess.run(['git', 'diff', '--check'], check=True)
subprocess.run(['git', 'add', '--', *[str(p.relative_to(ROOT)) for p, _ in updates]], check=True)
print('Applied 17 hash-verified source edits; no deployment, data or secret was accessed.')
